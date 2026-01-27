import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { UserEntity } from '../../../user/v1/entity/user.entity.js';
import { AdEntity } from './ad.entity.js';

export class AdViewEntity extends Model {
    declare id: string;
    declare adId: string;
    declare userId: string;
    declare firstSeenAt: Date;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

AdViewEntity.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        adId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        firstSeenAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        sequelize,
        modelName: 'AdView',
        tableName: 'ad_views',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['adId', 'userId'],
            },
            {
                fields: ['adId'],
            },
            {
                fields: ['userId'],
            },
        ],
    }
);

AdViewEntity.belongsTo(AdEntity, { foreignKey: 'adId', as: 'ad', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
AdEntity.hasMany(AdViewEntity, { foreignKey: 'adId', as: 'views', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

AdViewEntity.belongsTo(UserEntity, { foreignKey: 'userId', as: 'user' });
UserEntity.hasMany(AdViewEntity, { foreignKey: 'userId', as: 'adViews' });
