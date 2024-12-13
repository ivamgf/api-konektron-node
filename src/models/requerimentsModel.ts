import { Sequelize, DataTypes, Model } from "sequelize";
import { AnalisysHaveRequirements } from "../models/analisysHaveRequirementsModel"

export interface RequirementsAttributes {
    idRequirements: number;
    code: string | null;
    requirements: string | null;
    type: string | null;
    subType: string | null;
    technicalDescription: string | null;
    diagrams: string | null;
}

export class Requirements
    extends Model<RequirementsAttributes>
    implements RequirementsAttributes
{
    public idRequirements!: number;
    public code!: string | null;
    public requirements!: string | null;
    public type!: string | null;
    public subType!: string | null;
    public technicalDescription!: string | null;
    public diagrams!: string | null;
}

// Função para inicializar o modelo Requeriments
export const initRequerimentsModel = (sequelize: Sequelize): void => {
    Requirements.init(
        {
            idRequirements: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            code: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            requirements: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            type: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            subType: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            technicalDescription: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            diagrams: {
                type: DataTypes.STRING,
                allowNull: true,
            },
        },
        {
            sequelize,
            tableName: "requirements",
            timestamps: false,
        }
    );

    // Associações
    Requirements.hasMany(AnalisysHaveRequirements, {
        foreignKey: "idRequirements",
        as: "analisysAssociations",
    });
}

