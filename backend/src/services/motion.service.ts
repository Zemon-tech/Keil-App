import { supabase } from '../config/supabase'; // assuming supabase client exported
import { v4 as uuidv4 } from 'uuid';

export interface Motion {
  id: string;
  recording_id: string;
  owner_id: string;
  title?: string;
  is_public: boolean;
  share_token: string;
  created_at: string;
  updated_at: string;
}

/**
 * Create a new Motion entry linked to a recording.
 */
export const createMotion = async (data: {
  recordingId: string;
  ownerId: string;
  title?: string;
  isPublic?: boolean;
}): Promise<Motion> => {
  const shareToken = uuidv4();
  const { data: motion, error } = await supabase
    .from('motions')
    .insert([
      {
        recording_id: data.recordingId,
        owner_id: data.ownerId,
        title: data.title ?? null,
        is_public: data.isPublic ?? false,
        share_token: shareToken,
      },
    ])
    .single();
  if (error) {
    throw error;
  }
  return motion as Motion;
};

/** Retrieve a motion by its public share token. */
export const getMotionByToken = async (token: string): Promise<Motion | null> => {
  const { data: motion, error } = await supabase
    .from('motions')
    .select('*')
    .eq('share_token', token)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null; // no rows
    throw error;
  }
  return motion as Motion;
};

/** Retrieve a motion by its ID, optionally checking ownership. */
export const getMotionById = async (
  id: string,
  ownerId?: string
): Promise<Motion | null> => {
  let query = supabase.from('motions').select('*').eq('id', id);
  if (ownerId) query = query.eq('owner_id', ownerId);
  const { data: motion, error } = await query.single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return motion as Motion;
};
