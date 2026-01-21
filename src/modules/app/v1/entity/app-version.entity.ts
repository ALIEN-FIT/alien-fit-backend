import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';

export class AppVersionEntity extends Model {
    declare id: string;
    declare platform: string;
    declare latestVersion: string;
    declare minAllowedVersion?: string;
    declare apkKey?: string;
    declare apkUrl?: string;
    declare isMandatory?: boolean;
    declare releaseNotes?: object;
    declare metadata?: object;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

AppVersionEntity.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        platform: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        latestVersion: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        minAllowedVersion: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        apkKey: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        apkUrl: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        isMandatory: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        releaseNotes: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        metadata: {
            type: DataTypes.JSON,
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: 'AppVersion',
        tableName: 'app_versions',
        timestamps: true,
    }
);
