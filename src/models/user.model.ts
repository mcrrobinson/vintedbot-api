import {
    DataTypes,
    Model,
    Optional
} from 'sequelize';
import sequelize from '../config/database';
const bcrypt = require('bcrypt');

interface UserAttributes {
    id: number;
    name: string;
    email: string;
    password: string;
    created_at: Date;
    admin: boolean;
    verified: boolean;
}

interface UserCreationAttributes extends Optional < UserAttributes, 'id' > {}

class User extends Model < UserAttributes, UserCreationAttributes > implements UserAttributes {
    public id!: number;
    public name!: string;
    public email!: string;
    public password!: string;
    public created_at!: Date;
    public admin!: boolean;
    public verified!: boolean;
    public validPassword: ((password: string) => boolean) | undefined; // Fix this undefined

}

User.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    admin: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    verified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }

}, {
    sequelize,
    modelName: 'User'
});

User.beforeCreate((user: User) => {
    const salt = bcrypt.genSaltSync();
    user.password = bcrypt.hashSync(user.password, salt);
});

User.beforeUpdate((user: User) => {
    if (user.changed('password')) {
        const salt = bcrypt.genSaltSync();
        user.password = bcrypt.hashSync(user.password, salt);
    }
});

User.prototype.validPassword = function (password: string) {
    return bcrypt.compareSync(password, this.password);
}


export default User;