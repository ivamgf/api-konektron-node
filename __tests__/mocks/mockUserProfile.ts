import { Request, Response } from "express";
import mockData from "./mockData.json";

export const MockUserController = {
  registerUser: async (req: Request, res: Response) => {
    const { email, password, type } = req.body;

    const newUser = {
      id: mockData.users.length + 1,
      email,
      password,
      type,
      enabled: false,
    };
    mockData.users.push(newUser);

    res.status(201).json({
      message: "Usuário criado. Verifique seu e-mail para confirmar.",
      userId: newUser.id,
    });
  },

  confirmUser: async (req: Request, res: Response) => {
    const { userId } = req.params;

    const user = mockData.users.find((u) => u.id === Number(userId));
    if (user) {
      user.enabled = true;
      res.status(200).json({ message: "Usuário confirmado com sucesso." });
    } else {
      res.status(404).json({ error: "Usuário não encontrado." });
    }
  },

  changePassword: async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { newPassword } = req.body;

    const user = mockData.users.find((u) => u.id === Number(userId));
    if (user) {
      user.password = newPassword;
      res.status(200).json({ message: "Senha atualizada com sucesso." });
    } else {
      res.status(404).json({ error: "Usuário não encontrado." });
    }
  },

  queryUsers: async (req: Request, res: Response) => {
    const { userId } = req.params;

    if (userId) {
      const user = mockData.users.find((u) => u.id === Number(userId));
      if (user) {
        res.status(200).json(user);
      } else {
        res.status(404).json({ error: "Usuário não encontrado." });
      }
    } else {
      res.status(200).json(mockData.users);
    }
  },

  deleteUserController: async (req: Request, res: Response) => {
    const { userId } = req.params;

    const userIndex = mockData.users.findIndex((u) => u.id === Number(userId));
    if (userIndex !== -1) {
      // Remove perfis associados
      mockData.profiles = mockData.profiles.filter(
        (profile) => profile.userId !== Number(userId)
      );

      // Remove usuário
      mockData.users.splice(userIndex, 1);

      res.status(200).json({ message: "Usuário e suas associações deletados com sucesso." });
    } else {
      res.status(404).json({ error: "Usuário não encontrado." });
    }
  },
};
