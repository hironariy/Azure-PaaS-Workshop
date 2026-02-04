/**
 * Model Index
 * Re-exports all Mongoose models
 *
 * No PaaS changes - identical to IaaS
 */

export { User, IUser } from './User';
export { Post, IPost, generateSlug } from './Post';
export { Comment, IComment } from './Comment';
