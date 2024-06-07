/**
 * Copyright 2024 actions-toolkit authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export const IMAGE_LAYOUT_FILE_V1 = 'oci-layout';

export const IMAGE_LAYOUT_VERSION_V1 = '1.0.0';

export const IMAGE_INDEX_FILE_V1 = 'index.json';

export const IMAGE_BLOBS_DIR_V1 = 'blobs';

export interface ImageLayout {
  version: string;
}
