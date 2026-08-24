export type AiImageInput = { name: string; dataUrl: string };

export async function readAiImages(files: FileList | File[], limit = 6): Promise<AiImageInput[]> {
  const selected = Array.from(files).slice(0, limit);
  return Promise.all(selected.map((file) => new Promise<AiImageInput>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, dataUrl: String(reader.result) });
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  })));
}