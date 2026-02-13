import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { UserEntity } from '../../../user/v1/entity/user.entity.js';

export class UserBlockEntity extends Model {
    declare id: string;
    declare blockerId: string;
    declare blockedId: string;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

UserBlockEntity.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        blockerId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        blockedId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
    },
    {
        sequelize,
        modelName: 'UserBlock',
        tableName: 'user_blocks',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['blockerId', 'blockedId'],
            },
            {
                fields: ['blockerId'],
            },
            {
                fields: ['blockedId'],
            },
        ],
    },
);

UserBlockEntity.belongsTo(UserEntity, { foreignKey: 'blockerId', as: 'blocker' });
UserBlockEntity.belongsTo(UserEntity, { foreignKey: 'blockedId', as: 'blocked' });

UserEntity.hasMany(UserBlockEntity, { foreignKey: 'blockerId', as: 'blockedLinks', onDelete: 'CASCADE', hooks: true });
UserEntity.hasMany(UserBlockEntity, { foreignKey: 'blockedId', as: 'blockedByLinks', onDelete: 'CASCADE', hooks: true });
