import bcrypt from "bcryptjs";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/http";
import type { SessionUserDTO } from "@/types";

export function toSessionUser(user: User): SessionUserDTO {
  return { id: user.id, email: user.email, fullName: user.fullName, phone: user.phone ?? null, role: user.role };
}

export async function registerUser(input: {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
}): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new HttpError(409, "An account with this email already exists. Please sign in.");
  const passwordHash = await bcrypt.hash(input.password, 12);
  return prisma.user.create({
    data: {
      email: input.email,
      fullName: input.fullName,
      phone: input.phone ? input.phone : null,
      passwordHash,
    },
  });
}

export async function authenticate(email: string, password: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { email } });
  // Same error for "no such user" and "wrong password" so attackers cannot discover registered emails.
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid) throw new HttpError(401, "Incorrect email or password.");
  return user;
}

export async function getUserById(id: string): Promise<User | null> {
  if (!/^[a-f0-9]{24}$/i.test(id)) return null;
  return prisma.user.findUnique({ where: { id } });
}

/** After login, attach the guest cart in this browser to the user's account. */
export async function attachCartToUser(cartToken: string | undefined, userId: string): Promise<void> {
  if (!cartToken) return;
  await prisma.cart.updateMany({ where: { token: cartToken, userId: null }, data: { userId } });
}
