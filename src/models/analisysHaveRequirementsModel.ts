import { Sequelize, DataTypes, Model, Optional } from "sequelize";

// Interface para os atributos
export interface AnalisysHaveRequirementsAttributes {
    idAnalisysHaveRequirements: number;
    idAnalisys: number;
    idRequirements: number;
}

// Torne o `idAnalisysHaveRequirements` opcional para criação
export interface AnalisysHaveRequirementsCreationAttributes
    extends Optional<AnalisysHaveRequirementsAttributes, "idAnalisysHaveRequirements"> {}

// Torne o `idAnalisysHaveRequirements` opcional para criação
export interface AnalisysHaveRequirementsCreationAttributes
    extends Optional<AnalisysHaveRequirementsAttributes, "idAnalisysHaveRequirements"> {}

// Modelo AnalisysHaveRequirements
export class AnalisysHaveRequirements
    extends Model<AnalisysHaveRequirementsAttributes, AnalisysHaveRequirementsCreationAttributes>
    implements AnalisysHaveRequirementsAttributes
{
    public idAnalisysHaveRequirements!: number;
    public idAnalisys!: number;
    public idRequirements!: number;
}

// Função para inicializar o modelo AnalisysHaveRequirements
export const initAnalisysHaveRequirementsModel = (sequelize: Sequelize): void => {
    AnalisysHaveRequirements.init(
        {
            idAnalisysHaveRequirements: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            idAnalisys: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            idRequirements: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
        },
        {
            sequelize,
            tableName: "analisys_have_requirements",
            timestamps: false,
        }
    );
};
