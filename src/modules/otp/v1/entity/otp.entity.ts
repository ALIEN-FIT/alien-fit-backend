import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';

export class OTPEntity extends Model {
    declare id: string;
    declare phone: string;
    declare otp: string;
    declare expiresAt: Date;
    declare isUsed: boolean;
    declare attempts: number;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;

    public isValid(): boolean {
        return !this.isUsed && new Date() < this.expiresAt && this.attempts < 5;
    }
}

OTPEntity.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                is: /^\+?\d{10,15}$/,
            },
        },
        otp: {
            type: DataTypes.STRING(6),
            allowNull: false,
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        isUsed: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        attempts: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
    },
    {
        sequelize,
        modelName: 'OTP',
        tableName: 'otps',
        timestamps: true,
        indexes: [
            {
                fields: ['phone'],
            },
            {
                fields: ['expiresAt'],
            },
        ],
    }
);
