"use client";

import * as React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ImageOff,
  Link as LinkIcon,
  Star,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ApiError } from "@/lib/api/api-error";
import {
  usePublicUnitImages,
  useAddUnitImage,
  useUploadUnitImage,
  useReorderUnitImages,
  useSetUnitCoverImage,
  useDeleteUnitImage,
} from "@/lib/hooks/useUnits";
import { cn } from "@/lib/utils/cn";
import { getImageUrl } from "@/lib/utils/image";
import { toastSuccess, toastError } from "@/lib/utils/toast";
import type { UnitImageResponse } from "@/lib/types";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const directUrlSchema = z.object({
  imageUrl: z
    .string()
    .trim()
    .min(1, "من فضلك أدخل رابط صورة مباشر.")
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    }, "أدخل رابطًا صحيحًا يبدأ بـ http أو https."),
  isCover: z.boolean().optional(),
});

type DirectUrlValues = z.infer<typeof directUrlSchema>;
type ImageMode = "url" | "upload";

export interface UnitImagesTabProps {
  unitId: string;
}

export function UnitImagesTab({ unitId }: UnitImagesTabProps) {
  const { data: images = [], isLoading } = usePublicUnitImages(unitId);
  const { mutateAsync: addImage, isPending: isAdding } = useAddUnitImage();
  const { mutateAsync: uploadImage, isPending: isUploading } =
    useUploadUnitImage();
  const { mutateAsync: reorderImages, isPending: isReordering } =
    useReorderUnitImages();
  const { mutateAsync: setCover, isPending: isSettingCover } =
    useSetUnitCoverImage();
  const { mutateAsync: deleteImage, isPending: isDeleting } =
    useDeleteUnitImage();

  const [mode, setMode] = React.useState<ImageMode>("url");
  const [deleteTarget, setDeleteTarget] =
    React.useState<UnitImageResponse | null>(null);
  const [failedImageIds, setFailedImageIds] = React.useState<Set<string>>(
    () => new Set()
  );
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploadIsCover, setUploadIsCover] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<DirectUrlValues>({
    resolver: zodResolver(directUrlSchema),
    defaultValues: { imageUrl: "", isCover: false },
  });

  const watchedImageUrl = watch("imageUrl");

  const sorted = React.useMemo(
    () => [...images].sort((a, b) => a.displayOrder - b.displayOrder),
    [images]
  );

  const nextDisplayOrder = React.useMemo(() => {
    if (images.length === 0) return 0;
    return Math.max(...images.map((image) => image.displayOrder ?? 0)) + 1;
  }, [images]);

  const usesHttpUrl =
    watchedImageUrl?.trim().toLowerCase().startsWith("http:") ?? false;

  const isMutating =
    isAdding || isUploading || isReordering || isSettingCover || isDeleting;

  const markImageFailed = React.useCallback((imageId: string) => {
    setFailedImageIds((previous) => {
      const next = new Set(previous);
      next.add(imageId);
      return next;
    });
  }, []);

  const handleAddUrl = async (values: DirectUrlValues) => {
    try {
      await addImage({
        unitId,
        data: {
          fileKey: values.imageUrl.trim(),
          isCover: Boolean(values.isCover),
          displayOrder: nextDisplayOrder,
        },
      });
      toastSuccess("تمت إضافة الصورة");
      reset();
    } catch (error: unknown) {
      toastError((error as Error)?.message || "تعذر إضافة الصورة");
    }
  };

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
      return "نوع الملف غير مدعوم. استخدم JPG أو PNG أو WebP أو AVIF.";
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return "حجم الصورة أكبر من الحد المسموح.";
    }

    return null;
  };

  const selectUploadFile = (file: File | undefined) => {
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setSelectedFile(null);
      setUploadError(validationError);
      return;
    }

    setSelectedFile(file);
    setUploadError(null);
  };

  const handleUploadSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      setUploadError("اختر صورة من جهازك أولًا.");
      return;
    }

    const validationError = validateFile(selectedFile);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("isCover", String(uploadIsCover));
    formData.append("displayOrder", String(nextDisplayOrder));

    try {
      await uploadImage({ unitId, data: formData });
      toastSuccess("تم رفع الصورة وإضافتها");
      setSelectedFile(null);
      setUploadIsCover(false);
      setUploadError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error: unknown) {
      const message =
        error instanceof ApiError && error.status === 0
          ? "تعذر الاتصال بالخادم. تحقق من الاتصال وحاول مرة أخرى."
          : "فشل رفع الصورة. حاول مرة أخرى.";
      setUploadError(message);
      toastError(message);
    }
  };

  const handleSetCover = async (imageId: string) => {
    try {
      await setCover({ unitId, imageId });
      toastSuccess("Cover image updated");
    } catch (error: unknown) {
      toastError((error as Error)?.message || "Could not set cover image");
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const reordered = [...sorted];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= reordered.length) return;
    const temp = reordered[index]!;
    reordered[index] = reordered[swapIndex]!;
    reordered[swapIndex] = temp;
    const items = reordered.map((image, i) => ({
      imageId: image.id,
      displayOrder: i + 1,
    }));
    try {
      await reorderImages({ unitId, data: { items } });
      toastSuccess("Images reordered");
    } catch (error: unknown) {
      toastError((error as Error)?.message || "Could not reorder images");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteImage({ unitId, imageId: deleteTarget.id });
      toastSuccess("Image removed");
    } catch (error: unknown) {
      toastError((error as Error)?.message || "Could not remove image");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div dir="rtl">
            <h3 className="text-sm font-semibold text-neutral-800">
              إدارة صور الوحدة
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              أضف الصور برابط مباشر أو ارفعها من جهازك.
            </p>
          </div>

          <div
            className="inline-flex w-full rounded-lg border border-neutral-300 bg-white p-1 sm:w-auto"
            role="tablist"
            aria-label="Image add mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "url"}
              onClick={() => setMode("url")}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none",
                mode === "url"
                  ? "bg-primary-600 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              )}
              dir="rtl"
            >
              <LinkIcon className="h-4 w-4" />
              رابط مباشر
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "upload"}
              onClick={() => setMode("upload")}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none",
                mode === "upload"
                  ? "bg-primary-600 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              )}
              dir="rtl"
            >
              <UploadCloud className="h-4 w-4" />
              رفع من الجهاز
            </button>
          </div>
        </div>

        {mode === "url" ? (
          <form
            onSubmit={handleSubmit(handleAddUrl)}
            className="flex flex-col gap-3 lg:flex-row lg:items-start"
            dir="rtl"
          >
            <div className="flex-1">
              <Input
                label="رابط الصورة المباشر"
                placeholder="https://example.com/unit-photo.webp"
                helperText="استخدم رابط صورة مباشر من CDN أو أي استضافة عامة."
                dir="ltr"
                {...register("imageUrl")}
                error={errors.imageUrl?.message}
                disabled={isAdding}
              />
              {usesHttpUrl && !errors.imageUrl && (
                <div className="mt-2 flex items-start gap-2 rounded-md border border-warning-bg bg-warning-bg px-3 py-2 text-xs text-warning">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    الرابط يبدأ بـ http وقد لا يظهر على الموقع عبر HTTPS.
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3 lg:min-w-[220px]">
              <label className="flex min-h-9 items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  {...register("isCover")}
                  disabled={isAdding}
                  className="h-4 w-4 rounded border-neutral-300 text-primary-600"
                />
                اجعلها صورة الغلاف
              </label>
              <Button
                type="submit"
                disabled={isAdding}
                isLoading={isAdding}
                size="sm"
                fullWidth
              >
                إضافة الصورة
              </Button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={handleUploadSubmit}
            className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]"
            dir="rtl"
          >
            <div>
              <p className="mb-1.5 text-sm font-medium text-neutral-700">
                ارفع صورة من جهازك
              </p>
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  selectUploadFile(event.dataTransfer.files[0]);
                }}
                className={cn(
                  "flex min-h-[128px] flex-col items-center justify-center rounded-lg border border-dashed bg-white px-4 py-5 text-center transition-colors",
                  isDragging
                    ? "border-primary-500 bg-primary-50"
                    : "border-neutral-300"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="hidden"
                  onChange={(event) =>
                    selectUploadFile(event.currentTarget.files?.[0])
                  }
                  disabled={isUploading}
                />
                <UploadCloud className="mb-3 h-7 w-7 text-primary-600" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  اختيار صورة
                </Button>
                <p className="mt-3 text-xs text-neutral-500">
                  الأنواع المسموحة: JPG, PNG, WebP, AVIF — الحد الأقصى 5MB
                </p>
                {selectedFile && (
                  <p className="mt-2 max-w-full truncate text-sm font-medium text-neutral-800">
                    {selectedFile.name}
                  </p>
                )}
              </div>
              {uploadError && (
                <p className="mt-2 text-xs text-error">{uploadError}</p>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <label className="flex min-h-9 items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={uploadIsCover}
                  onChange={(event) => setUploadIsCover(event.target.checked)}
                  disabled={isUploading}
                  className="h-4 w-4 rounded border-neutral-300 text-primary-600"
                />
                اجعلها صورة الغلاف
              </label>
              <Button
                type="submit"
                disabled={isUploading}
                isLoading={isUploading}
                size="sm"
                fullWidth
              >
                {isUploading ? "جارٍ الرفع…" : "رفع وإضافة الصورة"}
              </Button>
            </div>
          </form>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="aspect-video animate-pulse rounded-lg bg-neutral-200"
            />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          title="No unit images"
          description="Add the first image above so operators can manage the unit gallery."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {sorted.map((image, index) => {
            const imageUrl = getImageUrl(image.fileKey);
            const imageFailed = failedImageIds.has(image.id) || !imageUrl;

            return (
              <div
                key={image.id}
                className="group relative overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100"
              >
                <div className="relative aspect-video w-full">
                  {imageFailed ? (
                    <div
                      className="flex h-full w-full flex-col items-center justify-center gap-2 bg-neutral-100 px-3 text-center text-xs font-medium text-neutral-500"
                      dir="rtl"
                    >
                      <ImageOff className="h-6 w-6 text-neutral-400" />
                      تعذر تحميل الصورة
                    </div>
                  ) : (
                    <Image
                      src={imageUrl}
                      alt={`Unit image ${index + 1}`}
                      fill
                      className="object-cover"
                      unoptimized
                      onError={() => markImageFailed(image.id)}
                    />
                  )}
                  {image.isCover && (
                    <div className="absolute start-2 top-2">
                      <Badge variant="warning" size="sm">
                        Cover
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-1 border-t border-neutral-200 bg-white p-1.5">
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      title="Move up"
                      aria-label="Move image up"
                      disabled={index === 0 || isMutating}
                      onClick={() => handleMove(index, "up")}
                      className="rounded p-1 text-neutral-500 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Move down"
                      aria-label="Move image down"
                      disabled={index === sorted.length - 1 || isMutating}
                      onClick={() => handleMove(index, "down")}
                      className="rounded p-1 text-neutral-500 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex gap-0.5">
                    {!image.isCover && (
                      <button
                        type="button"
                        title="Set as cover"
                        aria-label="Set image as cover"
                        disabled={isMutating}
                        onClick={() => handleSetCover(image.id)}
                        className="rounded p-1 text-neutral-500 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      title="Remove image"
                      aria-label="Remove image"
                      disabled={isMutating}
                      onClick={() => setDeleteTarget(image)}
                      className="rounded p-1 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Remove image"
        description={`Remove this image reference (${deleteTarget?.fileKey ?? ""})? This cannot be undone.`}
        confirmLabel="Remove image"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
