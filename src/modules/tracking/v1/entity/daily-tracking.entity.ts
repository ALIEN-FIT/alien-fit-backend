import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { UserEntity } from '../../../user/v1/entity/user.entity.js';

export interface ExtraTrainingEntry {
    description: string;
    durationMinutes?: number;
}

export interface ExtraFoodEntry {
    description: string;
    calories?: number;
}

export interface WaterIntakeRecord {
    intakeMl: number;
    time: string;
}

export class DailyTrackingEntity extends Model {
    declare id: string;
    declare userId: string;
    declare date: Date;
    declare trainingDone: boolean;
    declare dietDone: boolean;
    declare waterIntakeMl: number;
    declare waterIntakeRecords: WaterIntakeRecord[];
    declare trainingCompletedItemIds: string[];
    declare dietCompletedItemIds: string[];
    declare extraTrainingEntries: ExtraTrainingEntry[];
    declare extraFoodEntries: ExtraFoodEntry[];

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

DailyTrackingEntity.init(
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
        date: {
            type: DataTypes.DATEONLY,
            allowNull: false,
        },
        trainingDone: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        dietDone: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        waterIntakeMl: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
        },
        waterIntakeRecords: {
            type: DataTypes.JSONB,
            defaultValue: [],
            allowNull: false,
        },
        trainingCompletedItemIds: {
            type: DataTypes.JSONB,
            defaultValue: [],
        },
        dietCompletedItemIds: {
            type: DataTypes.JSONB,
            defaultValue: [],
        },
        extraTrainingEntries: {
            type: DataTypes.JSONB,
            defaultValue: [],
        },
        extraFoodEntries: {
            type: DataTypes.JSONB,
            defaultValue: [],
        },
    },
    {
        sequelize,
        modelName: 'DailyTracking',
        tableName: 'daily_tracking',
        timestamps: true,
        indexes: [
            {
                fields: ['userId', 'date'],
                unique: true,
            },
        ],
    }
);

DailyTrackingEntity.belongsTo(UserEntity, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE' });
UserEntity.hasMany(DailyTrackingEntity, { foreignKey: 'userId', as: 'dailyTracking', onDelete: 'CASCADE', hooks: true });
