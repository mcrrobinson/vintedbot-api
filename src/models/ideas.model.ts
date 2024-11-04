import { DataTypes, Model, Optional, SmallIntegerDataType } from 'sequelize';
import sequelize from '../config/database';

interface Include {
    word: string;
    must_be_included: boolean;
}

interface IdeaAttributes {
    id: number;
    created_at: Date;
    name: string;
    min_price: number;
    max_price: number;
    sizes: number[];
    condition: number[];
    keywords: string[];
    includes: Include[];
    excluded: string[];
    brands: number[];
    user_id: number;
    colour: number[];
    category: number;
    notification_frequency: number;
    category_friendly: string;
    brand_friendly: string[];
    condition_friendly: string[];
    last_executed: Date | null;
    results: number[];
}

interface UserCreationAttributes extends Optional<IdeaAttributes, 'id'> { }

class Ideas extends Model<IdeaAttributes, UserCreationAttributes> implements IdeaAttributes {
    public id!: number;
    public created_at!: Date;
    public name!: string;
    public min_price!: number;
    public max_price!: number;
    public sizes!: number[];
    public condition!: number[];
    public keywords!: string[];
    public includes!: Include[];
    public excluded!: string[];
    public brands!: number[];
    public user_id!: number;
    public colour!: number[];
    public category!: number;
    public notification_frequency!: number;
    public category_friendly!: string;
    public brand_friendly!: string[];
    public condition_friendly!: string[];
    public last_executed!: Date | null;
    public results!: number[];
}

Ideas.init({
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
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    min_price: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    max_price: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    sizes: {
        type: DataTypes.ARRAY(DataTypes.INTEGER),
        allowNull: false
    },
    condition: {
        type: DataTypes.ARRAY(DataTypes.INTEGER),
        allowNull: false
    },
    keywords: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false
    },
    includes: {
        type: DataTypes.JSON,
        allowNull: false
    },
    excluded: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false
    },
    brands: {
        type: DataTypes.ARRAY(DataTypes.INTEGER),
        allowNull: false
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    colour: {
        type: DataTypes.ARRAY(DataTypes.INTEGER),
        allowNull: false
    },
    category: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    notification_frequency: {
        type: DataTypes.STRING,
        allowNull: false
    },
    category_friendly: {
        type: DataTypes.STRING,
        allowNull: false
    },
    brand_friendly: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false
    },
    condition_friendly: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false
    },
    last_executed: {
        type: DataTypes.DATE,
        allowNull: true
    },
    results: {
        type: DataTypes.ARRAY(DataTypes.INTEGER),
        allowNull: false
    }
}, {
    sequelize,
    modelName: 'Ideas'
});

// Before adding the alert create a cron job in the postgres table



export default Ideas;
