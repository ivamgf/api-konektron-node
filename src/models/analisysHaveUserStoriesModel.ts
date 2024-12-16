import { Sequelize, DataTypes, Model, Optional } from "sequelize";

export interface AnalisysHaveUserStoriesAttributes {
    idAnalisysHaveUserStories: number;
    idAnalysis: number;
    idUserStory: number;
}

// Tornamos `idAnalisysHaveUserStories` opcional para criação
export interface AnalisysHaveUserStoriesCreationAttributes
    extends Optional<AnalisysHaveUserStoriesAttributes, "idAnalisysHaveUserStories"> {}

export class AnalisysHaveUserStories
    extends Model<AnalisysHaveUserStoriesAttributes, AnalisysHaveUserStoriesCreationAttributes>
    implements AnalisysHaveUserStoriesAttributes
{
    public idAnalisysHaveUserStories!: number;
    public idAnalysis!: number;
    public idUserStory!: number;
}

export const initAnalisysHaveUserStoriesModel = (sequelize: Sequelize): void => {
    AnalisysHaveUserStories.init(
        {
            idAnalisysHaveUserStories: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            idAnalysis: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            idUserStory: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
        },
        {
            sequelize,
            tableName: "analisys_have_user_stories",
            timestamps: false,
        }
    );
};
