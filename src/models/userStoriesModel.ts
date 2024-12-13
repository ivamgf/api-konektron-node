import { Sequelize, DataTypes, Model } from "sequelize";

export interface UserStoriesAttributes {
    idUserStories: number;
    code: string | null;
    title: string | null;
    asA: string | null;
    iWant: string | null;
    soThat: string | null;
    storyPoints: number | null;
    dateCreate: Date | null;
    dateUpdate: Date | null;
}

export class UserStories
    extends Model<UserStoriesAttributes>
    implements UserStoriesAttributes
{
    public idUserStories!: number;
    public code!: string | null;
    public title!: string | null;
    public asA!: string | null;
    public iWant!: string | null;
    public soThat!: string | null;
    public storyPoints!: number | null;
    public dateCreate!: Date | null;
    public dateUpdate!: Date | null;
}

// Função para inicializar o modelo UserStories
export const initUserStoriesModel = (sequelize: Sequelize): void => {
        UserStories.init(
        {
            idUserStories: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            code: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            title: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            asA: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            iWant: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            soThat: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            storyPoints: {
                type: DataTypes.INTEGER,
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
            tableName: "user_stories",
            timestamps: false,
        }
    );
}

