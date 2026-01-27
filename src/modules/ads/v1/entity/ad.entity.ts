import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { MediaEntity } from '../../../media/v1/model/media.model.js';

export const DiscountTypes = {
    PERCENTAGE: 'percentage',
    FIXED: 'fixed',
} as const;

export type DiscountType = (typeof DiscountTypes)[keyof typeof DiscountTypes];

export class AdEntity extends Model {
    declare id: string;

    declare imageId: string;
    declare appName: string;
    declare link: string | null;
    declare promoCode: string | null;

    declare discountAmount: string;
    declare discountType: DiscountType;

    declare startDate: Date;
    declare endDate: Date;

    declare priority: number;
    declare isActive: boolean;

    // Stats counters
    declare viewCount: number;
    declare clickCount: number;
    declare promoCopyCount: number;
    declare uniqueViewersCount: number;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

AdEntity.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        imageId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        appName: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        link: {
            type: DataTypes.STRING(2048),
            allowNull: true,
            defaultValue: null,
        },
        promoCode: {
            type: DataTypes.STRING(100),
            allowNull: true,
            defaultValue: null,
        },
        discountAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0,
        },
        discountType: {
            type: DataTypes.ENUM(DiscountTypes.PERCENTAGE, DiscountTypes.FIXED),
            allowNull: false,
            defaultValue: DiscountTypes.PERCENTAGE,
        },
        startDate: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        endDate: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        priority: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
        viewCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        clickCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        promoCopyCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        uniqueViewersCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
    },
    {
        sequelize,
        modelName: 'Ad',
        tableName: 'ads',
        timestamps: true,
        indexes: [
            { fields: ['isActive'] },
            { fields: ['priority'] },
            { fields: ['startDate'] },
            { fields: ['endDate'] },
        ],
    }
);

AdEntity.belongsTo(MediaEntity, { foreignKey: 'imageId', as: 'image' });
MediaEntity.hasMany(AdEntity, { foreignKey: 'imageId', as: 'ads' });
