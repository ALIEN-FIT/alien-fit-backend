import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { MediaEntity } from '../../../media/v1/model/media.model.js';

export class BeforeAfterHomeEntity extends Model {
    declare id: string;
    declare beforeImageId: string;
    declare afterImageId: string;
    declare title: string | null;
    declare description: string | null;
    declare priority: number;
    declare isActive: boolean;
    declare transformationTimeInDays: number;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

BeforeAfterHomeEntity.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        beforeImageId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        afterImageId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        title: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: null,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: null,
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
        transformationTimeInDays: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
    },
    {
        sequelize,
        modelName: 'BeforeAfterHome',
        tableName: 'before_after_homes',
        timestamps: true,
        indexes: [
            { fields: ['isActive'] },
            { fields: ['priority'] },
        ],
    },
);

BeforeAfterHomeEntity.belongsTo(MediaEntity, { foreignKey: 'beforeImageId', as: 'beforeImage' });
BeforeAfterHomeEntity.belongsTo(MediaEntity, { foreignKey: 'afterImageId', as: 'afterImage' });

MediaEntity.hasMany(BeforeAfterHomeEntity, { foreignKey: 'beforeImageId', as: 'beforeAfterHomeBeforeImages' });
MediaEntity.hasMany(BeforeAfterHomeEntity, { foreignKey: 'afterImageId', as: 'beforeAfterHomeAfterImages' });
