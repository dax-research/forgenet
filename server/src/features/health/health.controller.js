export const getHealth = (_request, response) => {
  return response.status(200).json({
    success: true,
    message: "ForgeNet API is running.",
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptimeInSeconds: Number(process.uptime().toFixed(2)),
    },
  });
};