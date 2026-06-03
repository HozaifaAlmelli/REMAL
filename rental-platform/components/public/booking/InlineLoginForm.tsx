// ═══════════════════════════════════════════════════════════
// components/public/booking/InlineLoginForm.tsx
// Login form — phone + password (NOT email)
// ═══════════════════════════════════════════════════════════

"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormData } from "@/lib/validations/auth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import api from "@/lib/api/axios";
import { authService } from "@/lib/api/services/auth.service";
import { endpoints } from "@/lib/api/endpoints";
import { useAuthStore } from "@/lib/stores/auth.store";
import { Eye, EyeOff } from "lucide-react";
import type { AuthResponse } from "@/lib/types/auth.types";

interface InlineLoginFormProps {
  onSuccess: (data: {
    clientId: string;
    contactName: string;
    contactPhone: string;
    contactEmail: string | null;
  }) => void;
}

export function InlineLoginForm({ onSuccess }: InlineLoginFormProps) {
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: "", password: "" },
  });

  const onSubmit = async (data: LoginFormData) => {
    setLoginError(null);

    try {
      const authData = await authService.clientLogin({
        phone: data.phone,
        password: data.password,
      });

      // Populate auth store
      setAuth({
        accessToken: authData.accessToken,
        expiresInSeconds: authData.expiresInSeconds,
        subjectType: authData.subjectType,
        user: authData.user,
        role: "Client",
      });

      // Pass contact info to parent booking form.
      // Some deployed API builds may not include name yet, so fall back to phone.
      onSuccess({
        clientId: authData.user.userId,
        contactName: authData.user.name?.trim() || authData.user.identifier,
        contactPhone: authData.user.identifier, // Phone number for clients
        contactEmail: null,
      });
    } catch (error) {
      const errorData = error as { response?: { data?: { message?: string } } };
      const message =
        errorData?.response?.data?.message ||
        "Invalid phone number or password.";
      setLoginError(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {/* Phone */}
      <Input
        label="Phone Number"
        placeholder="01012345678"
        type="tel"
        error={errors.phone?.message}
        helperText="The phone number you registered with"
        {...register("phone")}
      />

      {/* Password */}
      <div className="relative">
        <Input
          label="Password"
          placeholder="Enter your password"
          type={showPassword ? "text" : "password"}
          error={errors.password?.message}
          {...register("password")}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-[38px] text-neutral-400 hover:text-neutral-600"
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* API Error */}
      {loginError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {loginError}
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        isLoading={isSubmitting}
      >
        Log In & Continue
      </Button>
    </form>
  );
}
