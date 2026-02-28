import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { MediaEntity } from '../../../media/v1/model/media.model.js';

export class TrainingTagEntity extends Model {
    declare id: string;
    declare title: string;
    declare description: string | null;
    declare imageId: string;
    declare priority: number;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

export class TrainingVideoEntity extends Model {
    declare id: string;
    declare title: string;
    declare description: string | null;
    declare videoUrl: string;
    declare youtubeVideoId: string | null;
    declare isActive: boolean;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

export class TrainingVideoTagEntity extends Model {
    declare id: string;
    declare trainingVideoId: string;
    declare trainingTagId: string;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

TrainingTagEntity.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        imageId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'media',
                key: 'id',
            }
        },
        priority: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
        },
    },
    {
        sequelize,
        modelName: 'TrainingTag',
        tableName: 'training_tags',
        timestamps: true,
        indexes: [
            {
                fields: ['priority'],
            },
        ],
    }
);

TrainingVideoEntity.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        videoUrl: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        youtubeVideoId: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true,
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
    },
    {
        sequelize,
        modelName: 'TrainingVideo',
        tableName: 'training_videos',
        timestamps: true,
    }
);

TrainingVideoTagEntity.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        trainingVideoId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        trainingTagId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
    },
    {
        sequelize,
        modelName: 'TrainingVideoTag',
        tableName: 'training_video_tags',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['trainingVideoId', 'trainingTagId'],
            },
        ],
    }
);

TrainingVideoEntity.belongsToMany(TrainingTagEntity, {
    through: TrainingVideoTagEntity,
    as: 'tags',
    foreignKey: 'trainingVideoId',
    otherKey: 'trainingTagId',
});

TrainingTagEntity.belongsToMany(TrainingVideoEntity, {
    through: TrainingVideoTagEntity,
    as: 'videos',
    foreignKey: 'trainingTagId',
    otherKey: 'trainingVideoId',
});

TrainingTagEntity.belongsTo(MediaEntity, { foreignKey: 'imageId', as: 'image' });
MediaEntity.hasMany(TrainingTagEntity, { foreignKey: 'imageId', as: 'training_tags' });
