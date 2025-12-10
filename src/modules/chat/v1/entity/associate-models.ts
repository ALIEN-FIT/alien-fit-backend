import { UserEntity } from '../../../user/v1/entity/user.entity.js';
import { ChatEntity } from './chat.entity.js';
import { MessageEntity } from './message.entity.js';
import { MediaEntity } from '../../../media/v1/model/media.model.js';
import { MessageMediaEntity } from './message-media.entity.js';

UserEntity.hasOne(ChatEntity, { foreignKey: 'userId', as: 'chat', onDelete: 'CASCADE', hooks: true });
ChatEntity.belongsTo(UserEntity, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE' });

ChatEntity.hasMany(MessageEntity, { foreignKey: 'chatId', as: 'messages' });
MessageEntity.belongsTo(ChatEntity, { foreignKey: 'chatId', as: 'chat' });

MessageEntity.belongsTo(UserEntity, { foreignKey: 'senderId', as: 'sender', onDelete: 'CASCADE' });
UserEntity.hasMany(MessageEntity, { foreignKey: 'senderId', as: 'sentMessages', onDelete: 'CASCADE', hooks: true });

MessageEntity.belongsToMany(MediaEntity, {
    through: MessageMediaEntity,
    foreignKey: 'messageId',
    otherKey: 'mediaId',
    as: 'media',
});
MediaEntity.belongsToMany(MessageEntity, {
    through: MessageMediaEntity,
    foreignKey: 'mediaId',
    otherKey: 'messageId',
    as: 'messages',
});
MessageEntity.hasMany(MessageMediaEntity, { foreignKey: 'messageId', as: 'mediaLinks', onDelete: 'CASCADE', hooks: true });
MessageMediaEntity.belongsTo(MessageEntity, { foreignKey: 'messageId', as: 'message' });
MessageMediaEntity.belongsTo(MediaEntity, { foreignKey: 'mediaId', as: 'media' });
