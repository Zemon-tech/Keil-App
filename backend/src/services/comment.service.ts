import {
  commentRepository,
  activityRepository
} from '../repositories';
import { Comment, User } from '../types/entities';
import { LogEntityType, LogActionType } from '../types/enums';
import { CommentQueryOptions } from '../types/repository';
import { ApiError } from '../utils/ApiError';

/**
 * Comment Service - Business logic layer using repositories
 * Repositories return Entities, Services convert Entity → DTO
 */

// DTOs (Data Transfer Objects) for API responses
export interface CommentDTO {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  parent_comment_id: string | null;
  created_at: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    created_at: string;
  };
}

export interface ThreadedCommentDTO extends CommentDTO {
  replies: ThreadedCommentDTO[];
}

export interface CreateCommentData {
  task_id: string;
  user_id: string;
  content: string;
  parent_comment_id?: string | null;
}

export interface CommentActivityContext {
  workspace_id?: string | null;
  org_id?: string | null;
  space_id?: string | null;
}

/**
 * Safe ISO string conversion — handles both Date objects (top-level pg columns)
 * and strings (values inside json/jsonb aggregates, which pg never auto-parses).
 */
const toISO = (val: Date | string): string =>
  val instanceof Date ? val.toISOString() : val as string;

/**
 * Convert Comment entity to DTO
 */
const commentToDTO = (comment: Comment & { user: User }): CommentDTO => {
  return {
    id: comment.id,
    task_id: comment.task_id,
    user_id: comment.user_id,
    content: comment.content,
    parent_comment_id: comment.parent_comment_id,
    created_at: toISO(comment.created_at),
    user: {
      id: comment.user.id,
      email: comment.user.email,
      name: comment.user.name,
      created_at: toISO(comment.user.created_at)
    }
  };
};

/**
 * Recursively convert a threaded comment entity to DTO (unlimited depth)
 */
const threadedCommentToDTO = (
  comment: Comment & { user: User; replies: Array<any> }
): ThreadedCommentDTO => {
  return {
    id: comment.id,
    task_id: comment.task_id,
    user_id: comment.user_id,
    content: comment.content,
    parent_comment_id: comment.parent_comment_id,
    created_at: toISO(comment.created_at),
    user: {
      id: comment.user.id,
      email: comment.user.email,
      name: comment.user.name,
      created_at: toISO(comment.user.created_at)
    },
    replies: (comment.replies ?? []).map(threadedCommentToDTO)
  };
};

/**
 * Create a new comment or reply
 */
export const createComment = async (
  data: CreateCommentData,
  activityContext: string | CommentActivityContext
): Promise<CommentDTO> => {
  if (!data.content || data.content.trim().length === 0) {
    throw new ApiError(400, 'Comment content cannot be empty');
  }

  const context =
    typeof activityContext === 'string'
      ? { workspace_id: activityContext, org_id: null, space_id: null }
      : activityContext;

  const comment = await commentRepository.executeInTransaction(async (client) => {
    // Create comment
    const newComment = await commentRepository.create(data, client);

    // Log comment creation
    await activityRepository.log({
      workspace_id: context.workspace_id,
      org_id: context.org_id ?? null,
      space_id: context.space_id ?? null,
      user_id: data.user_id,
      entity_type: LogEntityType.COMMENT,
      entity_id: newComment.id,
      action_type: LogActionType.COMMENT_CREATED,
      old_value: null,
      new_value: { task_id: data.task_id, parent_comment_id: data.parent_comment_id }
    }, client);

    // Resolve notification recipients
    const taskRes = await client.query('SELECT created_by, title FROM public.tasks WHERE id = $1', [data.task_id]);
    const taskCreator = taskRes.rows[0]?.created_by;
    const taskTitle = taskRes.rows[0]?.title || 'Task';
    
    const assigneesRes = await client.query('SELECT user_id FROM public.task_assignees WHERE task_id = $1', [data.task_id]);
    const assigneeIds = assigneesRes.rows.map((r: any) => r.user_id as string);
    
    // Parse @mentions (matches name/email prefixes starting with @)
    const mentions = data.content.match(/@([a-zA-Z0-9_.-]+)/g) || [];
    const cleanMentions = mentions.map(m => m.substring(1).toLowerCase());
    
    const mentionedUserIds: string[] = [];
    if (cleanMentions.length > 0) {
      const usersRes = await client.query(
        `SELECT id FROM public.users WHERE LOWER(name) = ANY($1) OR LOWER(split_part(email, '@', 1)) = ANY($2)`,
        [cleanMentions, cleanMentions]
      );
      mentionedUserIds.push(...usersRes.rows.map((r: any) => r.id as string));
    }
    
    const senderRes = await client.query('SELECT name, email FROM public.users WHERE id = $1', [data.user_id]);
    const senderName = senderRes.rows[0]?.name || senderRes.rows[0]?.email || 'Someone';

    if (mentionedUserIds.length > 0) {
      // Trigger Mention notification job
      await client.query(
        `INSERT INTO public.notification_outbox (workspace_id, org_id, space_id, sender_id, event_type, entity_type, entity_id, payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          context.workspace_id,
          context.org_id ?? null,
          context.space_id ?? null,
          data.user_id,
          'mention_in_comment',
          'comment',
          newComment.id,
          JSON.stringify({
            recipient_ids: mentionedUserIds,
            task_title: taskTitle,
            sender_name: senderName,
            comment_snippet: data.content.substring(0, 100)
          })
        ]
      );
    } else {
      // Standard notification job (to assignees + creator, excluding sender)
      const recipients = Array.from(new Set([...assigneeIds, taskCreator])).filter(id => id && id !== data.user_id);
      if (recipients.length > 0) {
        await client.query(
          `INSERT INTO public.notification_outbox (workspace_id, org_id, space_id, sender_id, event_type, entity_type, entity_id, payload)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            context.workspace_id,
            context.org_id ?? null,
            context.space_id ?? null,
            data.user_id,
            'comment_created',
            'comment',
            newComment.id,
            JSON.stringify({
              recipient_ids: recipients,
              task_title: taskTitle,
              sender_name: senderName,
              comment_snippet: data.content.substring(0, 100)
            })
          ]
        );
      }
    }

    // Fetch comment with user details
    const comments = await commentRepository.findByTask(data.task_id, {}, client);
    const commentWithUser = comments.find(c => c.id === newComment.id);
    
    return commentWithUser!;
  });

  return commentToDTO(comment);
};

/**
 * Get comments by task with pagination
 */
export const getCommentsByTask = async (
  taskId: string,
  options: CommentQueryOptions = {}
): Promise<CommentDTO[]> => {
  const comments = await commentRepository.findByTask(taskId, options);
  return comments.map(commentToDTO);
};

/**
 * Get threaded comments (with nested replies)
 */
export const getThreadedComments = async (taskId: string): Promise<ThreadedCommentDTO[]> => {
  const comments = await commentRepository.findThreaded(taskId);
  return comments.map(threadedCommentToDTO);
};

/**
 * Get comment by ID
 */
export const getCommentById = async (commentId: string): Promise<CommentDTO | null> => {
  const comment = await commentRepository.findById(commentId);
  if (!comment) {
    return null;
  }

  // Fetch with user details
  const comments = await commentRepository.findByTask(comment.task_id);
  const commentWithUser = comments.find(c => c.id === commentId);
  
  return commentWithUser ? commentToDTO(commentWithUser) : null;
};

/**
 * Get replies to a comment
 */
export const getCommentReplies = async (parentCommentId: string): Promise<CommentDTO[]> => {
  const replies = await commentRepository.findReplies(parentCommentId);
  return replies.map(commentToDTO);
};

/**
 * Delete comment (soft delete, cascades to replies via DB)
 */
export const deleteComment = async (
  commentId: string,
  userId: string,
  activityContext: string | CommentActivityContext
): Promise<void> => {
  const context =
    typeof activityContext === 'string'
      ? { workspace_id: activityContext, org_id: null, space_id: null }
      : activityContext;

  await commentRepository.executeInTransaction(async (client) => {
    const comment = await commentRepository.findById(commentId, client);
    if (!comment) {
      throw new ApiError(404, 'Comment not found');
    }

    // Verify user owns the comment or has permission
    if (comment.user_id !== userId) {
      throw new ApiError(403, 'You do not have permission to delete this comment');
    }

    // Soft delete comment (DB cascade will handle replies)
    await commentRepository.softDelete(commentId, client);

    // Log deletion
    await activityRepository.log({
      workspace_id: context.workspace_id,
      org_id: context.org_id ?? null,
      space_id: context.space_id ?? null,
      user_id: userId,
      entity_type: LogEntityType.COMMENT,
      entity_id: commentId,
      action_type: LogActionType.COMMENT_DELETED,
      old_value: { task_id: comment.task_id, content: comment.content },
      new_value: null
    }, client);
  });
};

/**
 * Hard delete comment (permanent, cascades to replies via DB)
 */
export const hardDeleteComment = async (
  commentId: string,
  userId: string,
  activityContext: string | CommentActivityContext,
  spaceRole?: string
): Promise<void> => {
  const context =
    typeof activityContext === 'string'
      ? { workspace_id: activityContext, org_id: null, space_id: null }
      : activityContext;

  await commentRepository.executeInTransaction(async (client) => {
    const comment = await commentRepository.findById(commentId, client, true);
    if (!comment) {
      throw new ApiError(404, 'Comment not found');
    }

    // Verify user owns the comment or is space admin
    if (spaceRole !== 'admin' && comment.user_id !== userId) {
      throw new ApiError(403, 'You do not have permission to delete this comment');
    }

    // Hard delete comment (DB cascade will handle replies)
    await commentRepository.delete(commentId, client);

    // Log deletion
    await activityRepository.log({
      workspace_id: context.workspace_id,
      org_id: context.org_id ?? null,
      space_id: context.space_id ?? null,
      user_id: userId,
      entity_type: LogEntityType.COMMENT,
      entity_id: commentId,
      action_type: LogActionType.COMMENT_DELETED,
      old_value: { task_id: comment.task_id, content: comment.content },
      new_value: null
    }, client);
  });
};
