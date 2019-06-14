const path = require('path');
const { Storage } = require('@google-cloud/storage');
const slugify = require('@sindresorhus/slugify');

const slugifyFilename = file => {
  const filename = path.basename(file.name, file.ext);
  const ext = file.ext.toLowerCase();
  return `${slugify(filename)}${ext}`;
};

const createFilePath = file => {
  const filePath = file.path ? `${file.path}/` : `${file.hash}/`;
  return `${filePath}${slugifyFilename(file)}`;
};

module.exports = {
  provider: 'Google',
  name: 'Google Storage',
  auth: {
    serviceAccount: {
      label: 'Service Account JSON',
      type: 'textarea',
    },
    bucket: {
      label: 'Bucket',
      type: 'text',
    }
  },
  init: config => {

    if (!config.serviceAccount || !config.bucket) {
      throw new Error(
        '"Service Account JSON" and "Bucket" fields are required!'
      );
    }
    const bucketName = config.bucket;
    let serviceAccount = null;

    try {
      serviceAccount = JSON.parse(config.serviceAccount);
    } catch (e) {
      throw new Error('Error parsing service account JSON!');
    }

    const storage = new Storage({
      projectId: serviceAccount.project_id,
      credentials: {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key
      }
    });

    return {
      async upload(file) {
        const filePath = createFilePath(file);

        await storage
          .bucket(bucketName)
          .file(filePath)
          .save(file.buffer, {
            contentType: file.mime,
            public: true,
            metadata: {
              contentDisposition: `inline; filename="${file.name}"`
            }
          })
          .catch(error => {
            throw error;
          });

        file.url = `https://storage.googleapis.com/${bucketName}/${filePath}`;

        strapi.log.debug(`Uploaded to ${file.url}`);
      },
      async delete(file) {
        await storage
          .bucket(bucketName)
          .file(createFilePath(file))
          .delete()
          .catch(error => {
            if (error.code === 404) {
              return strapi.log.warn(
                'Remote file not found, you may have to delete manually!'
              );
            }
            throw error;
          });

        strapi.log.debug(`Deleted ${file.url}`);
      },
    };
  },
};