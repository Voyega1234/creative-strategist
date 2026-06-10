"use client";

import type { ReactNode } from "react";

import { Dialog } from "@/components/ui/dialog";

type AddImagesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export function AddImagesDialog({
  open,
  onOpenChange,
  children,
}: AddImagesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  );
}
