import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../../database/db-config.js';
import { UserEntity } from '../../../../user/v1/entity/user.entity.js';

export class DietPlanEntity extends Model {
    declare id: string;
    declare userId: string;
    declare startDate: Date;
    declare endDate: Date;
    declare recommendedWaterIntakeMl: number | null;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

export class DietPlanDayEntity extends Model {
    declare id: string;
    declare planId: string;
    declare dayIndex: number;
    declare date: Date;
    declare weekNumber: number;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

export class DietMealItemEntity extends Model {
    declare id: string;
    declare dayId: string;
    declare mealName: string;
    declare order: number;
    declare foods: Array<{
        name: string;
        grams: number;
        calories: number;
        fats: number;
        carbs: number;
    }>;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

DietPlanEntity.init(
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
        recommendedWaterIntakeMl: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: 'DietPlan',
        tableName: 'diet_plans',
        timestamps: true,
    }
);

DietPlanDayEntity.init(
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
        modelName: 'DietPlanDay',
        tableName: 'diet_plan_days',
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

DietMealItemEntity.init(
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
        mealName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        order: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        foods: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: [],
        },
    },
    {
        sequelize,
        modelName: 'DietMealItem',
        tableName: 'diet_meal_items',
        timestamps: true,
        indexes: [
            {
                fields: ['dayId', 'mealName', 'order'],
                unique: true,
            },
        ],
    }
);

DietPlanEntity.belongsTo(UserEntity, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE' });
UserEntity.hasOne(DietPlanEntity, { foreignKey: 'userId', as: 'dietPlan', onDelete: 'CASCADE', hooks: true });

DietPlanEntity.hasMany(DietPlanDayEntity, { foreignKey: 'planId', as: 'days', onDelete: 'CASCADE', hooks: true });
DietPlanDayEntity.belongsTo(DietPlanEntity, { foreignKey: 'planId', as: 'plan' });

DietPlanDayEntity.hasMany(DietMealItemEntity, { foreignKey: 'dayId', as: 'meals', onDelete: 'CASCADE', hooks: true });
DietMealItemEntity.belongsTo(DietPlanDayEntity, { foreignKey: 'dayId', as: 'day' });
