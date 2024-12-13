import { Sequelize, DataTypes, Model } from "sequelize";

export interface DiagramsAttributes {
    idDiagrams: number;
    title: string | null;
    description: string | null;
    url: string | null;
    dataCreate: Date | null;
    diagrams: Date | null;
}

export class Diagrams
    extends Model<DiagramsAttributes>
    implements DiagramsAttributes
{
    public idDiagrams!: number;
    public title!: string | null;
    public description!: string | null;
    public url!: string | null;
    public dataCreate!: Date | null;
    public diagrams!: Date | null;
}

// Função para inicializar o modelo Diagrams
export const initDiagramsModel = (sequelize: Sequelize): void => {
    Diagrams.init(
        {
            idDiagrams: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            title: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            url: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            dataCreate: {
                type: DataTypes.DATE,
                allowNull: true,
                defaultValue: DataTypes.NOW,
            },
            diagrams: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            sequelize,
            tableName: "diagrams",
            timestamps: false,
        }
    );
}

