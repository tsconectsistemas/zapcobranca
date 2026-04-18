import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import toast from "react-hot-toast";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { maskWhatsApp, unmaskDigits } from "@/lib/masks";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Cadastrar revenda — ZapCobrança" },
      {
        name: "description",
        content:
          "Cadastre sua revenda IPTV na plataforma ZapCobrança e comece a gerenciar suas cobranças.",
      },
    ],
  }),
  component: CadastroPage,
});

const cadastroSchema = z
  .object({
    companyName: z
      .string()
      .trim()
      .min(2, { message: "Informe o nome da empresa" })
      .max(120, { message: "Nome muito longo" }),
    email: z
      .string()
      .trim()
      .email({ message: "E-mail inválido" })
      .max(255, { message: "E-mail muito longo" }),
    whatsapp: z
      .string()
      .trim()
      .refine((v) => v === "" || unmaskDigits(v).length >= 10, {
        message: "WhatsApp inválido",
      })
      .refine((v) => unmaskDigits(v).length <= 11, {
        message: "WhatsApp inválido",
      }),
    password: z
      .string()
      .min(6, { message: "A senha deve ter no mínimo 6 caracteres" })
      .max(72, { message: "Senha muito longa" }),
    confirmPassword: z.string(),
    terms: z.literal(true, {
      message: "Você precisa aceitar os termos de uso",
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

function CadastroPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const parsed = cadastroSchema.safeParse({
      companyName,
      email,
      whatsapp,
      password,
      confirmPassword,
      terms,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }

    setSubmitting(true);
    const { error } = await signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      companyName: parsed.data.companyName,
      whatsapp: unmaskDigits(parsed.data.whatsapp),
    });
    setSubmitting(false);

    if (error) {
      // Translate common Supabase errors
      const msg = error.toLowerCase();
      if (msg.includes("already registered") || msg.includes("user already")) {
        toast.error("Este e-mail já está cadastrado");
      } else if (msg.includes("pwned") || msg.includes("password")) {
        toast.error(
          "Esta senha já apareceu em vazamentos. Escolha outra mais segura."
        );
      } else {
        toast.error(error);
      }
      return;
    }

    toast.success("Conta criada com sucesso! Bem-vindo ao ZapCobrança");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Logo size="lg" showTagline />
        </div>

        <div className="bg-card rounded-xl border p-6 sm:p-8 space-y-5">
          <h1 className="text-xl font-semibold text-center">
            Cadastrar sua revenda
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Nome da empresa</Label>
              <Input
                id="companyName"
                required
                maxLength={120}
                placeholder="Minha Revenda IPTV"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                maxLength={255}
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(99) 99999-9999"
                value={whatsapp}
                onChange={(e) => setWhatsapp(maskWhatsApp(e.target.value))}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                maxLength={72}
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                maxLength={72}
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={submitting}
              />
            </div>

            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox
                id="terms"
                checked={terms}
                onCheckedChange={(v) => setTerms(v === true)}
                disabled={submitting}
                className="mt-0.5"
              />
              <span className="text-muted-foreground">
                Concordo com os{" "}
                <span className="text-primary font-medium">termos de uso</span>
              </span>
            </label>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={submitting}
            >
              {submitting ? "Criando conta..." : "Criar conta"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Já tenho conta.{" "}
            <Link
              to="/login"
              className="text-primary font-medium hover:underline"
            >
              Fazer login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
