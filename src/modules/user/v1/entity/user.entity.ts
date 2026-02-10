import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { Roles } from '../../../../constants/roles.js';
import { comparePasswords, hashPassword } from '../../../../utils/password.utils.js';
import { generateAuthToken, generateRefreshToken } from '../../../../utils/token.utils.js';
import { UserSessionEntity } from '../../../user-session/v1/entity/user-session.entity.js';
import { MediaEntity } from '../../../media/v1/model/media.model.js';


// ---------- Model ----------
export class UserEntity extends Model {
    declare id: string;
    declare provider: string;
    declare password?: string;
    declare name: string;
    declare role: string;
    declare height?: number;
    declare weight?: number;
    declare age?: number;
    declare gender?: string;
    declare googleId?: string;
    declare isVerified: boolean;
    declare isBlocked: boolean;
    declare isProfileComplete?: boolean;
    declare imageId?: string | null;
    declare profileBackgroundImageId?: string | null;
    declare isOnline: boolean;
    declare lastSeen: Date | null;
    declare freeDays: number;

    // timestamps
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;

    // ---------- Instance methods ----------
    public generateAuthToken(sessionId: string) {
        return generateAuthToken.call(this, sessionId);
    }

    public async generateRefreshToken(sessionId: string): Promise<string> {
        return generateRefreshToken.call(this, sessionId);
    }

    public async validatePassword(password: string): Promise<boolean> {
        if (!this.password) return false;
        return comparePasswords(password, this.password);
    }
}

// ---------- Init Model ----------
UserEntity.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        provider: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                is: /^((\+?\d{1,3}[- ]?)?\d{10,15}|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/,
            },
        },
        password: {
            type: DataTypes.STRING,
            allowNull: true, // required only if no googleId
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
            validate: {
                len: [5, 255],
            },
        },
        role: {
            type: DataTypes.ENUM(...Object.values(Roles)),
            defaultValue: Roles.USER,
        },
        height: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: true,
        },
        weight: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: true,
        },
        age: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        gender: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        googleId: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: true,
        },
        isVerified: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        isBlocked: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        isProfileComplete: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        imageId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        profileBackgroundImageId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        isOnline: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false,
        },
        lastSeen: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null,
        },
        freeDays: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
        },
    },
    {
        sequelize,
        modelName: 'User',
        tableName: 'users',
        timestamps: true,
        defaultScope: {
            attributes: { exclude: ['password'] }, // hide password by default
        },
        scopes: {
            withPassword: {
                attributes: { include: ['password'] },
            },
        },
    }
);

// ---------- Hooks ----------
UserEntity.beforeSave(async (user: UserEntity) => {
    if (user.changed('password') && user.password) {
        user.password = await hashPassword(user.password);
    }
});

// ---------- Relations ----------
// Media relation for user image
UserEntity.belongsTo(MediaEntity, { foreignKey: 'imageId', as: 'image' });
MediaEntity.hasMany(UserEntity, { foreignKey: 'imageId', as: 'users' });

UserEntity.belongsTo(MediaEntity, { foreignKey: 'profileBackgroundImageId', as: 'profileBackgroundImage' });
MediaEntity.hasMany(UserEntity, { foreignKey: 'profileBackgroundImageId', as: 'profileBackgroundUsers' });

// Follow relations
export class UserFollowEntity extends Model {
    declare id: string;
    declare followerId: string;
    declare followingId: string;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

UserFollowEntity.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        followerId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        followingId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
    },
    {
        sequelize,
        modelName: 'UserFollow',
        tableName: 'user_follows',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['followerId', 'followingId'],
            },
            {
                fields: ['followerId'],
            },
            {
                fields: ['followingId'],
            },
        ],
    }
);

UserEntity.belongsToMany(UserEntity, {
    through: UserFollowEntity,
    as: 'followers',
    foreignKey: 'followingId',
    otherKey: 'followerId',
});

UserEntity.belongsToMany(UserEntity, {
    through: UserFollowEntity,
    as: 'following',
    foreignKey: 'followerId',
    otherKey: 'followingId',
});

UserFollowEntity.belongsTo(UserEntity, { foreignKey: 'followerId', as: 'follower' });
UserFollowEntity.belongsTo(UserEntity, { foreignKey: 'followingId', as: 'following' });
UserEntity.hasMany(UserFollowEntity, { foreignKey: 'followerId', as: 'followingLinks', onDelete: 'CASCADE', hooks: true });
UserEntity.hasMany(UserFollowEntity, { foreignKey: 'followingId', as: 'followerLinks', onDelete: 'CASCADE', hooks: true });