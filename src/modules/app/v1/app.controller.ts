import AppService from './app.service.js';

export const getLatestVersion = async (req, res) => {
    const { platform } = req.params;
    const record = await AppService.getLatestVersion(platform);
    res.json(record);
};

export const updateVersion = async (req, res) => {
    const { platform } = req.params;
    const payload = req.body;
    const record = await AppService.updateVersion(platform, payload);
    res.json(record);
};

export default {
    getLatestVersion
};
