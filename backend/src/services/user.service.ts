import { prisma } from "../lib/prisma";

export class UserService {
  async loadUserDetails(email: string) {
    try {
      const user = await prisma.user.findUnique({
        where: {
          email: email,
        },
      });

      return user;
    } catch (error: any) {
      throw new Error("Unable to load User Details");
    }
  }


}
