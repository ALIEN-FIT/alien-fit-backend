import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../../database/db-config.js';
import { TrainingVideoEntity } from '../../../../training-video/v1/entity/training-video.entity.js';

export class StaticTrainingPlanEntity extends Model {
    declare id: string;
    declare name: string;
    declare subTitle: string | null;
    declare description: string | null;
    declare imageId: string;
    declare durationInMinutes: number | null;
    declare level: string | null;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

export const StaticTrainingPlanTrainingTypes = ['REGULAR', 'SUPERSET', 'DROPSET', 'CIRCUIT'] as const;
export type StaticTrainingPlanTrainingType = (typeof StaticTrainingPlanTrainingTypes)[number];

export class StaticTrainingPlanTrainingEntity extends Model {
    declare id: string;
    declare planId: string;
    declare order: number;
    declare type: StaticTrainingPlanTrainingType;

    declare title: string | null;
    declare description: string | null;
    declare sets: number | null;
    declare repeats: number | null;
    declare duration: number | null;

    declare trainingVideoId: string | null;
    declare items: Array<Record<string, unknown>> | null;
    declare config: Record<string, unknown> | null;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

export class StaticTrainingPlanDayEntity extends Model {
    declare id: string;
    declare planId: string;
    declare dayIndex: number;
    declare weekNumber: number;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

export class StaticTrainingPlanItemEntity extends Model {
    declare id: string;
    declare dayId: string;
    declare order: number;
    declare title: string;
    declare videoLink: string | null;
    declare description: string | null;
    declare duration: number | null;
    declare repeats: number | null;
    declare sets: number | null;
    declare trainingVideoId: string;
    declare isSuperset: boolean;
    declare supersetItems: Array<Record<string, unknown>> | null;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

StaticTrainingPlanEntity.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        subTitle: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        imageId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        durationInMinutes: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        level: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: 'StaticTrainingPlan',
        tableName: 'static_training_plans',
        timestamps: true,
    },
);

StaticTrainingPlanTrainingEntity.init(
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
        order: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        type: {
            type: DataTypes.ENUM(...StaticTrainingPlanTrainingTypes),
            allowNull: false,
            defaultValue: 'REGULAR',
        },
        title: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        sets: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        repeats: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        duration: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        trainingVideoId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        items: {
            type: DataTypes.JSONB,
            allowNull: true,
        },
        config: {
            type: DataTypes.JSONB,
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: 'StaticTrainingPlanTraining',
        tableName: 'static_training_plan_trainings',
        timestamps: true,
        indexes: [
            {
                fields: ['planId', 'order'],
                unique: true,
            },
        ],
    },
);

StaticTrainingPlanDayEntity.init(
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
        weekNumber: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
        },
    },
    {
        sequelize,
        modelName: 'StaticTrainingPlanDay',
        tableName: 'static_training_plan_days',
        timestamps: true,
        indexes: [
            {
                fields: ['planId', 'dayIndex'],
                unique: true,
            },
        ],
    },
);

StaticTrainingPlanItemEntity.init(
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
        sets: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        trainingVideoId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        isSuperset: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        supersetItems: {
            type: DataTypes.JSONB,
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: 'StaticTrainingPlanItem',
        tableName: 'static_training_plan_items',
        timestamps: true,
        indexes: [
            {
                fields: ['dayId', 'order'],
                unique: true,
            },
        ],
    },
);

StaticTrainingPlanEntity.hasMany(StaticTrainingPlanDayEntity, {
    foreignKey: 'planId',
    as: 'days',
    onDelete: 'CASCADE',
    hooks: true,
});
StaticTrainingPlanDayEntity.belongsTo(StaticTrainingPlanEntity, { foreignKey: 'planId', as: 'plan' });

StaticTrainingPlanEntity.hasMany(StaticTrainingPlanTrainingEntity, {
    foreignKey: 'planId',
    as: 'trainings',
    onDelete: 'CASCADE',
    hooks: true,
});
StaticTrainingPlanTrainingEntity.belongsTo(StaticTrainingPlanEntity, { foreignKey: 'planId', as: 'plan' });

StaticTrainingPlanDayEntity.hasMany(StaticTrainingPlanItemEntity, {
    foreignKey: 'dayId',
    as: 'items',
    onDelete: 'CASCADE',
    hooks: true,
});
StaticTrainingPlanItemEntity.belongsTo(StaticTrainingPlanDayEntity, { foreignKey: 'dayId', as: 'day' });
StaticTrainingPlanItemEntity.belongsTo(TrainingVideoEntity, { foreignKey: 'trainingVideoId', as: 'trainingVideo' });
TrainingVideoEntity.hasMany(StaticTrainingPlanItemEntity, { foreignKey: 'trainingVideoId', as: 'staticTrainingPlanItems' });

StaticTrainingPlanTrainingEntity.belongsTo(TrainingVideoEntity, { foreignKey: 'trainingVideoId', as: 'trainingVideo' });
TrainingVideoEntity.hasMany(StaticTrainingPlanTrainingEntity, {
    foreignKey: 'trainingVideoId',
    as: 'staticTrainingPlanTrainings',
});
