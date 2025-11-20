import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../../database/db-config.js';
import { UserEntity } from '../../../../user/v1/entity/user.entity.js';

export class TrainingPlanEntity extends Model {
    declare id: string;
    declare userId: string;
    declare startDate: Date;
    declare endDate: Date;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

export class TrainingPlanDayEntity extends Model {
    declare id: string;
    declare planId: string;
    declare dayIndex: number;
    declare date: Date;
    declare weekNumber: number;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

export class TrainingPlanItemEntity extends Model {
    declare id: string;
    declare dayId: string;
    declare order: number;
    declare title: string;
    declare videoLink: string | null;
    declare description: string | null;
    declare duration: number | null;
    declare repeats: number | null;
    declare isSuperset: boolean;
    declare supersetExercises: Array<Record<string, unknown>> | null;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

TrainingPlanEntity.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
            unique: true,
        },
        startDate: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        endDate: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    },
    {
        sequelize,
        modelName: 'TrainingPlan',
        tableName: 'training_plans',
        timestamps: true,
    }
);

TrainingPlanDayEntity.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        planId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        dayIndex: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        date: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        weekNumber: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
    },
    {
        sequelize,
        modelName: 'TrainingPlanDay',
        tableName: 'training_plan_days',
        timestamps: true,
        indexes: [
            {
                fields: ['planId', 'dayIndex'],
                unique: true,
            },
            {
                fields: ['planId', 'date'],
                unique: true,
            },
        ],
    }
);

TrainingPlanItemEntity.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        dayId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        order: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        videoLink: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        duration: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        repeats: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        isSuperset: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        supersetExercises: {
            type: DataTypes.JSONB,
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: 'TrainingPlanItem',
        tableName: 'training_plan_items',
        timestamps: true,
        indexes: [
            {
                fields: ['dayId', 'order'],
                unique: true,
            },
        ],
    }
);

TrainingPlanEntity.belongsTo(UserEntity, { foreignKey: 'userId', as: 'user' });
UserEntity.hasOne(TrainingPlanEntity, { foreignKey: 'userId', as: 'trainingPlan' });

TrainingPlanEntity.hasMany(TrainingPlanDayEntity, { foreignKey: 'planId', as: 'days', onDelete: 'CASCADE', hooks: true });
TrainingPlanDayEntity.belongsTo(TrainingPlanEntity, { foreignKey: 'planId', as: 'plan' });

TrainingPlanDayEntity.hasMany(TrainingPlanItemEntity, { foreignKey: 'dayId', as: 'items', onDelete: 'CASCADE', hooks: true });
TrainingPlanItemEntity.belongsTo(TrainingPlanDayEntity, { foreignKey: 'dayId', as: 'day' });
