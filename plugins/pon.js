import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

// Reaction emojis
const rwait = '⏳'; // Waiting
const done = '✅'; // Done
const errorEmoji = '❌'; // Error
const uploadEmoji = '📤'; // Uploading

// Utility to manage download sessions
const manageDownloadSessions = (conn, namespace) => {
    conn[namespace] = conn[namespace] || {};
    return {
        set: (key, value) => { conn[namespace][key] = value; },
        get: (key) => conn[namespace][key],
        remove: (key) => { delete conn[namespace][key]; },
    };
};

// Sanitize and shorten file names
const sanitizeFileName = (name, maxLength = 100) => {
    const sanitized = name.replace(/[^a-zA-Z0-9_\-]/g, '_');
    return sanitized.length > maxLength ? sanitized.slice(0, maxLength) : sanitized;
};

// Function to get available formats for a video URL using yt-dlp
const getAvailableFormats = (url) => {
    return new Promise((resolve, reject) => {
        const command = `yt-dlp --list-formats "${url}"`;
        console.log(`${rwait} Running yt-dlp to get available formats for URL: ${url}`);
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`${errorEmoji} Error fetching video formats:`, stderr);
                reject(`Error fetching video formats: ${stderr}`);
                return;
            }
            const formats = stdout
                .trim()
                .split('\n')
                .filter((line) => line.match(/^\w+/))
                .map((line) => {
                    const formatId = line.match(/^\S+/)?.[0];
                    const resolution = line.match(/(\d+p)/)?.[1] || 'Unknown';
                    const filesize = line.match(/~([\d\.]+MiB)/)?.[1] || 'Unknown size';
                    return { formatId, resolution, filesize };
                });
            console.log(`${done} Formats extracted:`, formats);
            resolve(formats);
        });
    });
};

// Function to get video title using yt-dlp
const getVideoTitle = (url) => {
    return new Promise((resolve, reject) => {
        const command = `yt-dlp --get-title "${url}"`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`${errorEmoji} Error fetching video title:`, stderr);
                reject(`Error fetching video title: ${stderr}`);
                return;
            }
            resolve(stdout.trim());
        });
    });
};

// Function to download video using yt-dlp
const downloadVideoWithYTDLP = (url, formatId, outputPath) => {
    return new Promise((resolve, reject) => {
        const command = `yt-dlp -f ${formatId} -o "${outputPath}" "${url}"`;
        console.log(`${rwait} Downloading video in format ${formatId}`);
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`${errorEmoji} Error downloading video:`, stderr);
                reject(`Error downloading video: ${stderr}`);
                return;
            }
            console.log(`${done} Video downloaded successfully:`, stdout);
            resolve(outputPath);
        });
    });
};

// Function to upload the downloaded video
const uploadFile = async (filePath, conn, m) => {
    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    const asDocument = stats.size > 64 * 1024 * 1024;

    console.log(`${uploadEmoji} Uploading file: ${filePath}`);
    await m.react('📤');
    await conn.sendFile(
        m.chat,
        filePath,
        fileName,
        '© JPS',
        m,
        false,
        { asDocument }
    );
    fs.unlinkSync(filePath);
    console.log(`${done} Upload complete and file cleaned: ${fileName}`);
    await m.react('✅');
};

// Handler for the main command
const handler = async (m, { conn, text }) => {
    console.log(`${rwait} Handler triggered with text: ${m.text}`);

    const hlsSessions = manageDownloadSessions(conn, 'hlsDownloads');
    if (!text || !/^https?:\/\/[^\s]+$/i.test(text)) {
        throw `${errorEmoji} Invalid URL format. Please provide a valid video URL.`;
    }

    const url = text.trim();
    console.log(`${rwait} Valid URL received: ${url}`);

    try {
        const formats = await getAvailableFormats(url);
        const videoTitle = await getVideoTitle(url);
        console.log(`${rwait} Available formats fetched:`, formats);

        if (formats.length === 0) {
            console.log(`${errorEmoji} No formats available for this URL.`);
            conn.reply(m.chat, `${errorEmoji} No formats available for this URL. Try another URL.`, m);
            return;
        }

        const optionsMessage = formats
            .map((f, index) => `${index + 1}. ${f.resolution} (${f.formatId}) - ${f.filesize}`)
            .join('\n');
        const replyMessage = `Available qualities:\n\n${optionsMessage}\n\nReply with the number to select.`;
        conn.reply(m.chat, replyMessage, m);
        
        const replyKey = m.key;
        hlsSessions.set(m.sender, {
            url,
            videoTitle,
            replyKey,
            formats,
            timeout: setTimeout(() => {
                console.log(`${errorEmoji} Timeout reached for user: ${m.sender}`);
                const session = hlsSessions.get(m.sender);
                if (session) {
                    conn.reply(m.chat, `${errorEmoji} Timeout! Please start over.`, m);
                    hlsSessions.remove(m.sender);
                }
            }, 150 * 1000),
        });
    } catch (err) {
        console.error(`${errorEmoji} Error fetching video formats:`, err);
        conn.reply(m.chat, `${errorEmoji} Error fetching video formats. Try another URL.`, m);
    }
};

// Before handler for quality selection
handler.before = async (m, { conn }) => {
    const hlsSessions = manageDownloadSessions(conn, 'hlsDownloads');
    const session = hlsSessions.get(m.sender);

    if (!session) {
        console.log(`${errorEmoji} No active session for user: ${m.sender}`);
        return;
    }

    const userChoice = m.text.trim();
    const choiceIndex = parseInt(userChoice, 10) - 1;

    if (isNaN(choiceIndex) || choiceIndex < 0 || choiceIndex >= session.formats.length) {
        await conn.reply(m.chat, `${errorEmoji} Invalid choice. Please reply with a valid number.`, m);
        return;
    }

    const selectedFormat = session.formats[choiceIndex];
    const sanitizedTitle = sanitizeFileName(session.videoTitle);
    const outputFileName = `${sanitizedTitle}.mp4`;
    const outputPath = path.resolve(`./${outputFileName}`);

    try {
        const finalPath = await downloadVideoWithYTDLP(session.url, selectedFormat.formatId, outputPath);
        hlsSessions.remove(m.sender);
        await m.react('⏳');

        await uploadFile(finalPath, conn, m);
    } catch (error) {
        console.error(`${errorEmoji} Error during download/upload:`, error.message);
        conn.reply(m.chat, `${errorEmoji} Error downloading the video. Try another quality.`, m);
    }
};

handler.help = ['pon'];
handler.tags = ['downloader'];
handler.command = ['pon'];
export default handler;
