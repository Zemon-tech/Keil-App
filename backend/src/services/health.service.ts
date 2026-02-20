export const getHealthData = () => {
    return {
        status: "ok",
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString()
    };
};
