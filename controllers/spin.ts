export const getSpinOptions = async () => {
  const res = await fetch(`${API_URL}/api/spin/options`, {
    credentials: 'include', // 👈 allows cookies/session to persist
  });
  if (!res.ok) throw new Error('Failed to get spin options');
  return res.json();
};

