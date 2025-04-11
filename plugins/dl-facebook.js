import fetch from 'node-fetch';
import { exec } from 'child_process'; // Importing exec from child_process to run yt-dlp
import fs from 'fs';  // Importing fs module to handle file system operations
import path from 'path'; // Importing path module to handle file paths

const handler = async (m, { conn, args, usedPrefix, command }) => {
  console.log('Handler invoked with arguments:', { args, usedPrefix, command });

  if (!args[0]) {
    console.log('No URL provided');
    throw `✳️ Please send the link of a Facebook video\n\n📌 EXAMPLE :\n*${usedPrefix + command}* https://www.facebook.com/Ankursajiyaan/videos/981948876160874/?mibextid=rS40aB7S9Ucbxw6v`;
  }

  const normalizeUrl = (url) => {
    console.log('Normalizing URL:', url);
    // Updated regex to match both `/videos/`, `/share/v/`, and `/share/r/`
    const videoIdRegex = /(?:videos|share\/(?:v|r))\/([a-zA-Z0-9]+)/;
    const match = url.match(videoIdRegex);
    if (match && match[1]) {
        const normalized = `https://www.facebook.com/share/v/${match[1]}`;
        console.log('Normalized URL:', normalized);
        return normalized;
    }
    console.log('Failed to normalize URL');
    throw '⚠️ PLEASE GIVE A VALID URL.';
};

const normalizedUrl = normalizeUrl(args[0]);

const urlRegex = /^(?:https?:\/\/)?(?:www\.)?(?:facebook\.com|fb\.watch)\/.+/i;
if (!urlRegex.test(normalizedUrl)) {
    console.log('URL does not match valid pattern:', normalizedUrl);
    throw '⚠️ PLEASE GIVE A VALID URL.';
}


  console.log('URL passed validation:', normalizedUrl);
  m.react('⏳'); // Show that the process is ongoing

  try {
    // Set the permanent output path
    const outputPath = '/home/sasi/jps/downloads/%(title)s.%(ext)s';
    console.log('Using permanent output path:', outputPath); // Log the fixed output path

    // Running yt-dlp command to download the video (forcing the download and not overwriting)
    const commandToRun = `yt-dlp -f hd --cookies "/home/sasi/jps/fbcook.txt" -o "${outputPath}" --no-post-overwrites "${normalizedUrl}"`;
    console.log('Executing yt-dlp command:', commandToRun); // Added console log for command execution

    exec(commandToRun, async (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing yt-dlp: ${error}`);
        m.reply('⚠️ An error occurred while processing the request. Please try again later.');
        return;
      }

      if (stderr) {
        console.error(`yt-dlp stderr: ${stderr}`);
        m.reply('⚠️ An error occurred while processing the request. Please try again later.');
        return;
      }

      // Log the full stdout output to help diagnose the issue
      console.log('yt-dlp stdout:', stdout);

      // Attempt to extract the file path from the stdout
      const filePathMatch = stdout.match(/Destination: (.+)/);
      console.log('File path match:', filePathMatch); // Log the result of regex match

      if (!filePathMatch) {
        console.log('Video file path not found in yt-dlp output');
        m.reply('⚠️ Unable to fetch the video file.');
        return;
      }

      const filePath = path.resolve('/home/sasi/jps/downloads', filePathMatch[1]);
      console.log('Resolved file path:', filePath); // Log the resolved file path

      // Check if the file exists
      fs.exists(filePath, async (exists) => {
        console.log('Does the file exist?', exists); // Log file existence check
        if (!exists) {
          console.log('File does not exist after download');
          m.reply('⚠️ The video file is not available.');
          return;
        }

        // Check the file size to determine if it should be sent as a document
        const stats = fs.statSync(filePath);
        console.log(`File size: ${stats.size / (1024 * 1024)} MB`); // Log file size

        const asDocument = stats.size > 64 * 1024 * 1024; // Send as document if > 64MB
        console.log('Sending as document?', asDocument); // Log whether it's sent as document

        // Send the video file to the chat (either as a regular file or a document)
        const fileName = path.basename(filePath); // Get the file name from the path
        await conn.sendFile(
          m.chat,
          filePath,
          fileName,
          '★彡[ ©️נρѕ ]彡★',
          m,
          false,
          { asDocument }
        );

        // React with 'done' after sending the file
        m.react('✅');
        console.log('Video successfully sent');

        // Cleanup: Delete the file after uploading
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error(`Failed to delete the file: ${err}`);
          } else {
            console.log('File deleted successfully');
          }
        });
      });
    });
  } catch (error) {
    console.error('Error occurred during processing:', error);
    m.reply('⚠️ An error occurred while processing the request. Please try again later.');
  }
};

handler.help = ['facebook <url>'];
handler.tags = ['downloader'];
handler.command = /^((facebook|fb)(downloader|dl)?)$/i;
handler.diamond = true;

export default handler;
