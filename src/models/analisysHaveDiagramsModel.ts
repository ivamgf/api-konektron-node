import { Sequelize, DataTypes, Model, Optional } from "sequelize";

export interface AnalisysHaveDiagramsAttributes {
    idAnalisysHaveDiagrams: number;
    idAnalisys: number;
    idDiagrams: number;
}

export interface AnalisysHaveDiagramsCreationAttributes
    extends Optional<AnalisysHaveDiagramsAttributes, "idAnalisysHaveDiagrams"> {}

export class AnalisysHaveDiagrams
    extends Model<AnalisysHaveDiagramsAttributes, AnalisysHaveDiagramsCreationAttributes>
    implements AnalisysHaveDiagramsAttributes
{
    public idAnalisysHaveDiagrams!: number;
    public idAnalisys!: number;
    public idDiagrams!: number;
}

export const initAnalisysHaveDiagramsModel = (sequelize: Sequelize): void => {
    AnalisysHaveDiagrams.init(
        {
            idAnalisysHaveDiagrams: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            idAnalisys: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            idDiagrams: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
        },
        {
            sequelize,
            tableName: "analisys_have_diagrams",
            timestamps: false,
        }
    );
};
