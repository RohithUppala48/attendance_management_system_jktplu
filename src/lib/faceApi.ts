export async function captureImageFromVideo(video: HTMLVideoElement): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg');
  }
  
  export async function sendFaceToBackend(
    imageDataUrl: string,
    userId: string,
    endpoint: 'register_face' | 'verify_face'
  ): Promise<any> {
    const formData = new FormData();
    formData.append('user_id', userId);
    formData.append('image', imageDataUrl);
  
    const res = await fetch(`http://localhost:5001/${endpoint}`, {
      method: 'POST',
      body: formData,
    });
    return await res.json();
  }