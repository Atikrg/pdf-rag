import express from "express";
import multer from "multer";
import path from "path";

const fileFilter = (request: any, file: any, cb: any) => {
  if (file.mimetype === "application/pdf") {
    console.log("file upoad true");
    cb(null, true);
  } else {
    cb(new Error("Only PDF Allowed!"), false);
  }
};

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
});
