import {
    DataTypes,
    Model,
    Optional
} from 'sequelize';
import sequelize from '../config/database';
import { json } from 'sequelize';

interface MappingAttributes {
    id: number;
    created_at: Date;
    map: Object;
}

interface UserCreationAttributes extends Optional < MappingAttributes, 'id' > {}

class Mapping extends Model < MappingAttributes, UserCreationAttributes > implements MappingAttributes {
    public id!: number;
    public created_at!: Date;
    public map!: Object;

}

Mapping.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    map: {
        type: DataTypes.JSON,
        allowNull: false
    }
}, {
    sequelize,
    modelName: 'Mapping'
});

export default Mapping;