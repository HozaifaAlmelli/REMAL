// ═══════════════════════════════════════════════════════════
// components/public/booking/InlineRegisterForm.tsx
// Registration form — name, phone, email (optional), password
// Calls register then auto-login (2 API calls)
// ═══════════════════════════════════════════════════════════

"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterFormData } from "@/lib/validations/auth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import api from "@/lib/api/axios";
import { authService } from "@/lib/api/services/auth.service";
import { endpoints } from "@/lib/api/endpoints";
import { useAuthStore } from "@/lib/stores/auth.store";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
import type {
  ClientProfileResponse,
  AuthResponse,
} from "@/lib/types/auth.types";

interface InlineRegisterFormProps {
  onSuccess: (data: {
    clientId: string;
    contactName: string;
    contactPhone: string;
    contactEmail: string | null;
  }) => void;
}

export function InlineRegisterForm({ onSuccess }: InlineRegisterFormProps) {
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", phone: "", email: "", password: "" },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setRegisterError(null);

    try {
      // Step 1: Register — returns profile ONLY, NO access token
      const registerPayload = {
        name: data.name,
        phone: data.phone,
        email: data.email || undefined, // Send undefined, NOT empty string
        password: data.password,
      };
      const profile = await authService.clientRegister(registerPayload);

      // Step 2: Auto-login — obtain JWT with same credentials
      // This MUST happen immediately after registration
      try {
        const authData = await authService.clientLogin({
          phone: data.phone,
          password: data.password,
        });

        // Step 3: Populate auth store
        setAuth({
          accessToken: authData.accessToken,
          expiresInSeconds: authData.expiresInSeconds,
          subjectType: authData.subjectType,
          user: authData.user,
          role: "Client", // Map subjectType to role
        });

        // Step 4: Pass contact info to parent booking form
        onSuccess({
          clientId: authData.user.userId,
          contactName: profile.name,
          contactPhone: profile.phone,
          contactEmail: profile.email,
        });
      } catch {
        // Registration succeeded but auto-login failed
        // User has an account but is NOT authenticated
        toast.error(
          "Account created but auto-login failed. Please log in manually."
        );
        setRegisterError(
          "Account created successfully, but we could not log you in automatically. Please use the 'Already have an account' tab to log in."
        );
      }
    } catch (error) {
      const errorData = error as {
        response?: { data?: { message?: string; errors?: string[] } };
      };
      const message =
        errorData?.response?.data?.message ||
        errorData?.response?.data?.errors?.[0] ||
        "Registration failed. Please try again.";
      setRegisterError(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {/* Name */}
      <Input
        label="Full Name"
        placeholder="Enter your full name"
        error={errors.name?.message}
        {...register("name")}
      />

      {/* Phone */}
      <Input
        label="Phone Number"
        placeholder="01012345678"
        type="tel"
        error={errors.phone?.message}
        helperText="Egyptian phone number"
        {...register("phone")}
      />

      {/* Email (optional) */}
      <Input
        label="Email (optional)"
        placeholder="you@example.com"
        type="email"
        error={errors.email?.message}
        {...register("email")}
      />

      {/* Password */}
      <div className="relative">
        <Input
          label="Password"
          placeholder="Min 8 characters"
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
      {registerError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {registerError}
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
        Create Account & Continue
      </Button>

      <p className="text-center text-xs text-neutral-500">
        By creating an account, you agree to our Terms of Service.
      </p>
    </form>
  );
}
