import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { UserEntity } from '../../../user/v1/entity/user.entity.js';

export type PlanUpdateRequestStatus = 'pending' | 'approved' | 'rejected';

export class PlanUpdateRequestEntity extends Model {
    declare id: string;
    declare userId: string;
    declare status: PlanUpdateRequestStatus;
    declare type: string;
    declare payload: Record<string, unknown> | null;
    declare notes: string | null;
    declare approvedBy: string | null;
    declare approvedAt: Date | null;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

PlanUpdateRequestEntity.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM('pending', 'approved', 'rejected'),
            defaultValue: 'pending',
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        payload: {
            type: DataTypes.JSONB,
            allowNull: true,
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        approvedBy: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        approvedAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: 'PlanUpdateRequest',
        tableName: 'plan_update_requests',
        timestamps: true,
        indexes: [
            {
                fields: ['userId'],
            },
            {
                fields: ['status'],
            },
        ],
    }
);

PlanUpdateRequestEntity.belongsTo(UserEntity, { foreignKey: 'userId', as: 'user' });
UserEntity.hasMany(PlanUpdateRequestEntity, { foreignKey: 'userId', as: 'planUpdateRequests' });
