import { UserEntity } from "../../../user/v1/entity/user.entity.js";
import { UserSessionEntity } from "./user-session.entity.js";


UserEntity.hasMany(UserSessionEntity, { foreignKey: 'userId', as: 'sessions', onDelete: 'CASCADE', hooks: true });
UserSessionEntity.belongsTo(UserEntity, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE' });