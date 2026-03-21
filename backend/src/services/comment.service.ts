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
  replies: CommentDTO[];
}

export interface CreateCommentData {
  task_id: string;
  user_id: string;
  content: string;
  parent_comment_id?: string | null;
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
 * Convert threaded comment entity to DTO
 */
const threadedCommentToDTO = (
  comment: Comment & { user: User; replies: Array<Comment & { user: User }> }
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
    replies: comment.replies.map(reply => ({
      id: reply.id,
      task_id: reply.task_id,
      user_id: reply.user_id,
      content: reply.content,
      parent_comment_id: reply.parent_comment_id,
      created_at: toISO(reply.created_at),
      user: {
        id: reply.user.id,
        email: reply.user.email,
        name: reply.user.name,
        created_at: toISO(reply.user.created_at)
      }
    }))
  };
};

/**
 * Create a new comment or reply
 */
export const createComment = async (
  data: CreateCommentData,
  workspaceId: string
): Promise<CommentDTO> => {
  if (!data.content || data.content.trim().length === 0) {
    throw new ApiError(400, 'Comment content cannot be empty');
  }

  const comment = await commentRepository.executeInTransaction(async (client) => {
    // Create comment
    const newComment = await commentRepository.create(data, client);

    // Log comment creation
    await activityRepository.log({
      workspace_id: workspaceId,
      user_id: data.user_id,
      entity_type: LogEntityType.COMMENT,
      entity_id: newComment.id,
      action_type: LogActionType.COMMENT_CREATED,
      old_value: null,
      new_value: { task_id: data.task_id, parent_comment_id: data.parent_comment_id }
    }, client);

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
  workspaceId: string
): Promise<void> => {
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
      workspace_id: workspaceId,
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
  workspaceId: string
): Promise<void> => {
  await commentRepository.executeInTransaction(async (client) => {
    const comment = await commentRepository.findById(commentId, client, true);
    if (!comment) {
      throw new ApiError(404, 'Comment not found');
    }

    // Verify user owns the comment or has permission
    if (comment.user_id !== userId) {
      throw new ApiError(403, 'You do not have permission to delete this comment');
    }

    // Hard delete comment (DB cascade will handle replies)
    await commentRepository.delete(commentId, client);

    // Log deletion
    await activityRepository.log({
      workspace_id: workspaceId,
      user_id: userId,
      entity_type: LogEntityType.COMMENT,
      entity_id: commentId,
      action_type: LogActionType.COMMENT_DELETED,
      old_value: { task_id: comment.task_id, content: comment.content },
      new_value: null
    }, client);
  });
};
