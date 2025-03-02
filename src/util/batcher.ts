interface UploadImageRequest {
  imageUrl: string;
  key: string;
}

export const batchRequests = (requests: UploadImageRequest[], batchSize: number): UploadImageRequest[][] => {
  const numBatches = Math.ceil(requests.length / batchSize);

  return [...Array(numBatches)].map((_, i) => {
    const start = i * batchSize;
    const end = start + batchSize;

    return requests.slice(start, end);
  });
};
