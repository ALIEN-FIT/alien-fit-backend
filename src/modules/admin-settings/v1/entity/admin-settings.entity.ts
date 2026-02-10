import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';

export class AdminSettingsEntity extends Model {
    declare id: string;
    declare settingKey: string;
    declare settingValue: string;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

AdminSettingsEntity.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        settingKey: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        settingValue: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
    },
    {
        sequelize,
        modelName: 'AdminSettings',
        tableName: 'admin_settings',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['settingKey'],
            },
        ],
    }
);
