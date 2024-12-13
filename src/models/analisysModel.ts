import { Sequelize, DataTypes, Model } from "sequelize";

export interface AnalysisAttributes {
    idAnalysis: number;
    title: string;
    goal: string | null;
    description: string | null;
    scope: string | null;
    technicalDescription: string | null;
    dateCreate: Date | null;
    dateUpdate: Date | null;
}

export class Analysis extends Model<AnalysisAttributes> implements AnalysisAttributes {
    public idAnalysis!: number;
    public title!: string;
    public goal!: string | null;
    public description!: string | null;
    public scope!: string | null;
    public technicalDescription!: string | null;
    public dateCreate!: Date | null;
    public dateUpdate!: Date | null;
}

// Função para inicializar o modelo Analisys
export const initAnalisysModel = (sequelize: Sequelize): void => {
    Analysis.init(
        {
            idAnalysis: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            title: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            goal: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            scope: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            technicalDescription: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            dateCreate: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            dateUpdate: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            sequelize,
            tableName: "analysis",
            timestamps: false,
        }
    ); 
}

