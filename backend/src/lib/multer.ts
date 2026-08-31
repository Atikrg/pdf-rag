import multer from "multer";

const fileFilter = (
  request: any,
  file: any,
  cb: (error: Error | null, accept?: boolean) => void,
) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF Allowed!"), false);
  }
};

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
});
