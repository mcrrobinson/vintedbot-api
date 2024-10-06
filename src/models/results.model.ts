import {
    DataTypes,
    Model,
    Optional
} from 'sequelize';
import sequelize from '../config/database';

interface ResultsAttributes {
    id: number;
    created_at: Date;
    url: string;
    title: string;
    photo_url: string;
    alert_id: number;
    thumbnail: string;
    price: number;
}

interface UserCreationAttributes extends Optional < ResultsAttributes, 'id' > {}

class Results extends Model < ResultsAttributes, UserCreationAttributes > implements ResultsAttributes {
    public id!: number;
    public created_at!: Date;
    public url!: string;
    public title!: string;
    public photo_url!: string;
    public alert_id!: number;
    public thumbnail!: string;
    public price!: number;

}

Results.init({
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
    url: {
        type: DataTypes.STRING,
        allowNull: false
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    photo_url: {
        type: DataTypes.STRING,
        allowNull: false
    },
    alert_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    thumbnail: {
        type: DataTypes.STRING,
        allowNull: false
    },
    price: {
        type: DataTypes.DECIMAL,
        allowNull: false
    }

}, {
    sequelize,
    modelName: 'Results'
});

export default Results;