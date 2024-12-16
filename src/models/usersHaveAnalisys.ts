import { Sequelize, DataTypes, Model, Optional } from "sequelize";

export interface UsersHaveAnalysisAttributes {
    idUsersHaveAnalysis: number;
    idUser: number;
    idAnalysis: number;
}

// Tornamos `idUsersHaveAnalysis` opcional para criação
export interface UsersHaveAnalysisCreationAttributes
    extends Optional<UsersHaveAnalysisAttributes, "idUsersHaveAnalysis"> {}

export class UsersHaveAnalysis
    extends Model<UsersHaveAnalysisAttributes, UsersHaveAnalysisCreationAttributes>
    implements UsersHaveAnalysisAttributes
{
    public idUsersHaveAnalysis!: number;
    public idUser!: number;
    public idAnalysis!: number;
}

export const initUsersHaveAnalysisModel = (sequelize: Sequelize): void => {
    UsersHaveAnalysis.init(
        {
            idUsersHaveAnalysis: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            idUser: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            idAnalysis: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
        },
        {
            sequelize,
            tableName: "users_have_analysis",
            timestamps: false,
        }
    );
};
