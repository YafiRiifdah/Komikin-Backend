const errorHandler = (err, req, res, next) => {
  console.error("ERROR STACK:", err.stack); // Log error stack ke konsol

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);

  res.json({
    message: err.message,
    // Tampilkan stack trace hanya saat development (opsional)
    stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
  });
};

module.exports = { errorHandler };